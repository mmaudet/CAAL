/**
 * Workflow Sanitizer - Client-side sanitization for CAAL Tool Registry
 *
 * This ensures that secrets never leave the user's network.
 * All sensitive data is stripped in the browser before transmission.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkflowData = any; // n8n workflow structure is dynamic

export interface SanitizationResult {
  sanitized: WorkflowData;
  detected: {
    credentials: Array<{
      credential_type: string;
      name: string;
    }>;
    variables: Array<{
      name: string;
      example?: string; // Optional - credential variables don't have examples
      description: string;
    }>;
    private_urls: string[]; // Private network URLs that will be parameterized by VPS
    secrets_stripped: {
      api_keys: number;
      tokens: number;
      passwords: number;
    };
  };
  warnings: string[];
}

// Secret detection patterns
const SECRET_PATTERNS = [
  { name: 'API Key', regex: /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/gi, type: 'api_keys' },
  { name: 'Bearer token', regex: /bearer\s+[a-zA-Z0-9_-]{20,}/gi, type: 'tokens' },
  { name: 'OpenAI key', regex: /sk-[a-zA-Z0-9]{20,}/g, type: 'api_keys' },
  { name: 'GitHub PAT', regex: /ghp_[a-zA-Z0-9]{36}/g, type: 'tokens' },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, type: 'api_keys' },
  { name: 'Slack token', regex: /xox[baprs]-[0-9a-zA-Z]{10,}/g, type: 'tokens' },
  {
    name: 'Private key',
    regex: /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+)?PRIVATE\s+KEY-----/gi,
    type: 'api_keys',
  },
  { name: 'Password', regex: /password\s*[:=]\s*["'][^"']+["']/gi, type: 'passwords' },
] as const;

// Expression patterns that reference secrets via n8n expressions
const EXPRESSION_SECRET_PATTERNS = [
  {
    name: 'Environment variable',
    regex: /\{\{.*\$env\.[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD|API)[A-Z_]*.*\}\}/gi,
  },
  {
    name: 'JSON secret field',
    regex: /\{\{.*\$json\.(?:apiKey|api_key|token|secret|password).*\}\}/gi,
  },
  { name: 'Binary secret field', regex: /\{\{.*\$binary\.(?:key|token|secret).*\}\}/gi },
] as const;

// Private network IP patterns (RFC 1918)
// 10.0.0.0 - 10.255.255.255, 172.16.0.0 - 172.31.255.255, 192.168.0.0 - 192.168.255.255
const PRIVATE_IP_URL_PATTERN =
  /https?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/[^\s"']*)?/g;

/**
 * Recursively find all __rl (resource locator) fields with mode: "list"
 * These are dropdown selections that need to be converted to id mode
 */
interface ResourceLocator {
  path: string;
  value: string;
  cachedName: string | null;
}

function findResourceLocators(
  obj: WorkflowData,
  path = '',
  results: ResourceLocator[] = []
): ResourceLocator[] {
  if (!obj || typeof obj !== 'object') return results;

  if (obj.__rl === true && obj.mode === 'list') {
    results.push({
      path,
      value: obj.value,
      cachedName: obj.cachedResultName || obj.cachedResultUrl || null,
    });
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      findResourceLocators(value, path ? `${path}.${key}` : key, results);
    }
  }

  return results;
}

/**
 * Convert a resource locator from list mode to id mode
 */
function convertResourceLocatorToId(variablePlaceholder: string) {
  return {
    __rl: true,
    mode: 'id',
    value: variablePlaceholder,
  };
}

/**
 * Set a nested property by path (e.g., "nodes.0.parameters.calendar")
 */
function setNestedProperty(obj: WorkflowData, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Detect secrets in workflow JSON
 */
function detectSecrets(workflowStr: string): {
  api_keys: number;
  tokens: number;
  passwords: number;
  found: string[];
} {
  const counts = {
    api_keys: 0,
    tokens: 0,
    passwords: 0,
    found: [] as string[],
  };

  for (const { name, regex, type } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    const matches = workflowStr.match(regex);
    if (matches && matches.length > 0) {
      counts[type] += matches.length;
      counts.found.push(name);
    }
  }

  return counts;
}

/**
 * Detect expression secrets ({{ $env.SECRET }}, {{ $json.apiKey }})
 */
function detectExpressionSecrets(workflowStr: string): string[] {
  const found: string[] = [];

  for (const { name, regex } of EXPRESSION_SECRET_PATTERNS) {
    regex.lastIndex = 0;
    const matches = workflowStr.match(regex);
    if (matches && matches.length > 0) {
      found.push(`${name} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  return found;
}

/**
 * Detect secrets in code nodes (jsCode, pythonCode parameters)
 */
function detectCodeNodeSecrets(workflow: WorkflowData): {
  api_keys: number;
  tokens: number;
  passwords: number;
  found: string[];
} {
  const counts = {
    api_keys: 0,
    tokens: 0,
    passwords: 0,
    found: [] as string[],
  };

  if (!workflow.nodes) return counts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const node of workflow.nodes as any[]) {
    // Check for code nodes (n8n-nodes-base.code)
    if (node.type === 'n8n-nodes-base.code') {
      const codeContent = node.parameters?.jsCode || node.parameters?.pythonCode || '';

      if (codeContent) {
        // Scan code content for hardcoded secrets
        for (const { name, regex, type } of SECRET_PATTERNS) {
          regex.lastIndex = 0;
          const matches = codeContent.match(regex);
          if (matches && matches.length > 0) {
            counts[type] += matches.length;
            if (!counts.found.includes(name)) {
              counts.found.push(name);
            }
          }
        }
      }
    }
  }

  return counts;
}

/**
 * Detect private network URLs in workflow (RFC 1918 addresses)
 * These will be parameterized by the VPS LLM
 */
function detectPrivateUrls(workflowStr: string): string[] {
  const urlMatches = workflowStr.match(PRIVATE_IP_URL_PATTERN) || [];

  // Extract unique base URLs (origin only - scheme + host + port)
  // Filter out URLs where the HOST itself contains expressions (already parameterized)
  const baseUrls = new Set<string>();

  for (const fullUrl of urlMatches) {
    // Extract origin (everything before the first / after the port)
    // Pattern: http(s)://ip:port or http(s)://ip
    const originMatch = fullUrl.match(/^https?:\/\/[^/]+/);
    if (originMatch) {
      const origin = originMatch[0];
      // Only skip if the origin itself contains expressions
      if (!origin.includes('${') && !origin.includes('{{')) {
        baseUrls.add(origin);
      }
    }
  }

  return [...baseUrls];
}

/**
 * Extract credential types from workflow
 */
function extractCredentials(workflow: WorkflowData): Array<{
  credential_type: string;
  name: string;
}> {
  const credentialTypes = new Set<string>();
  const credentials: Array<{ credential_type: string; name: string }> = [];

  if (!workflow.nodes) return credentials;

  for (const node of workflow.nodes) {
    if (node.credentials) {
      for (const [credType, credInfo] of Object.entries(node.credentials)) {
        if (!credentialTypes.has(credType)) {
          credentialTypes.add(credType);
          credentials.push({
            credential_type: credType,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (credInfo as any)?.name || credType,
          });
        }
      }
    }
  }

  return credentials;
}

/**
 * Nullify credential IDs and parameterize credential names
 * Returns the modified workflow and a list of credential variables
 */
function parameterizeCredentials(workflow: WorkflowData): {
  workflow: WorkflowData;
  credentialVariables: Array<{ name: string; description: string }>;
} {
  const credentialVariables: Array<{ name: string; description: string }> = [];
  const seenCredTypes = new Set<string>();

  if (!workflow.nodes) return { workflow, credentialVariables };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.nodes = workflow.nodes.map((node: any) => {
    if (node.credentials) {
      for (const [credType] of Object.entries(node.credentials)) {
        // Generate variable name from credential type
        // e.g., googleCalendarOAuth2Api -> GOOGLE_CALENDAR_OAUTH2_API_CREDENTIAL
        const varName = credType.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2') + '_CREDENTIAL';

        // Add to variables list (once per credential type)
        if (!seenCredTypes.has(credType)) {
          seenCredTypes.add(credType);
          credentialVariables.push({
            name: varName,
            description: `Your ${credType} credential name`,
          });
        }

        // Parameterize the credential (strip original name completely)
        node.credentials[credType] = {
          id: null,
          name: `\${${varName}}`,
        };
      }
    }
    return node;
  });

  return { workflow, credentialVariables };
}

/**
 * Main sanitization function
 */
export function sanitizeWorkflow(workflow: WorkflowData): SanitizationResult {
  const warnings: string[] = [];

  // 1. Create clean workflow copy FIRST - strip instance-specific fields
  // This prevents detecting duplicates in activeVersion, meta, etc.
  let sanitized: WorkflowData = {
    name: workflow.name,
    nodes: JSON.parse(JSON.stringify(workflow.nodes || [])),
    connections: JSON.parse(JSON.stringify(workflow.connections || {})),
    settings: JSON.parse(JSON.stringify(workflow.settings || {})),
  };

  // 2. Detect secrets on the clean workflow
  const workflowStr = JSON.stringify(sanitized);
  const secrets = detectSecrets(workflowStr);
  const expressionSecrets = detectExpressionSecrets(workflowStr);
  const codeNodeSecrets = detectCodeNodeSecrets(sanitized);

  // CRITICAL: Block if hardcoded secrets found in workflow JSON
  if (secrets.found.length > 0) {
    throw new Error(
      `Cannot submit workflow with hardcoded secrets: ${secrets.found.join(', ')}. ` +
        `Please configure these as n8n Credentials in your workflow and re-export.`
    );
  }

  // CRITICAL: Block if hardcoded secrets found in code nodes
  if (codeNodeSecrets.found.length > 0) {
    throw new Error(
      `Cannot submit workflow with hardcoded secrets in code nodes: ${codeNodeSecrets.found.join(', ')}. ` +
        `Please remove hardcoded secrets from your JavaScript/Python code. ` +
        `Use n8n Credentials or expressions to reference secrets instead.`
    );
  }

  // CRITICAL: Block if expression secrets found
  if (expressionSecrets.length > 0) {
    throw new Error(
      `Cannot submit workflow with expression-based secrets: ${expressionSecrets.join(', ')}. ` +
        `Expressions like {{ $env.API_KEY }} or {{ $json.password }} expose secrets. ` +
        `Please use n8n Credentials instead.`
    );
  }

  // 3. Detect private network URLs (will be parameterized by VPS LLM)
  const privateUrls = detectPrivateUrls(workflowStr);

  // 4. Detect resource locators (dropdown selections)
  const resourceLocators = findResourceLocators(sanitized);
  const rlVariables = resourceLocators.map((rl) => {
    const fieldName = rl.path.split('.').pop() || 'field';
    const varName = fieldName.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2');

    return {
      name: varName,
      // DON'T send user's actual value - use generic placeholder
      // The VPS LLM may suggest a better variable name based on context
      description: `Your ${fieldName} identifier`,
    };
  });

  // 5. Extract credentials
  const credentials = extractCredentials(sanitized);

  // 6. Convert resource locators to id mode with variable placeholders
  for (let i = 0; i < resourceLocators.length; i++) {
    const rl = resourceLocators[i];
    const variable = rlVariables[i];
    setNestedProperty(sanitized, rl.path, convertResourceLocatorToId(`\${${variable.name}}`));
  }

  // 7. Parameterize credentials (nullify IDs and replace names with variables)
  const { workflow: sanitizedWithCreds } = parameterizeCredentials(sanitized);
  sanitized = sanitizedWithCreds;

  // 8. Check for webhook description
  const webhookNode = sanitized.nodes?.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n: any) => n.type === 'n8n-nodes-base.webhook' || n.type?.includes('webhook')
  );

  if (webhookNode && !webhookNode.notes) {
    warnings.push(
      "No webhook description found. Add a description to the webhook node's notes in n8n."
    );
  }

  return {
    sanitized,
    detected: {
      credentials,
      variables: rlVariables, // Resource locators only - URLs handled by VPS
      private_urls: privateUrls, // Private network URLs for modal display
      secrets_stripped: {
        api_keys: secrets.api_keys + codeNodeSecrets.api_keys,
        tokens: secrets.tokens + codeNodeSecrets.tokens,
        passwords: secrets.passwords + codeNodeSecrets.passwords,
      },
    },
    warnings,
  };
}
