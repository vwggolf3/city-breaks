import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let secretsCache: Record<string, string> | null = null;

export const getSecrets = async (): Promise<Record<string, string>> => {
  if (secretsCache) return secretsCache;
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const response = await client.send(new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN }));
  secretsCache = JSON.parse(response.SecretString!);
  return secretsCache!;
};
