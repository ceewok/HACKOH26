// Centralized runtime config. Reads from env with sensible local defaults.

export const config = {
  region: process.env.AWS_REGION ?? "us-east-1",
  tableName: process.env.TABLE_NAME ?? "bridge-builder",
  /** Set for DynamoDB Local; leave unset to use real AWS DynamoDB. */
  dynamoEndpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  bedrock: {
    modelId:
      process.env.BEDROCK_MODEL_ID ??
      "anthropic.claude-3-5-sonnet-20241022-v2:0",
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  },
  port: Number(process.env.PORT ?? 4000),
};

/**
 * SDK options shared by the repository and local-table setup. DynamoDB Local
 * still requires credentials at the SDK layer; these are intentionally dummy
 * local-only values and are never used for an AWS endpoint.
 */
export const dynamoClientOptions = {
  region: config.region,
  ...(config.dynamoEndpoint
    ? {
        endpoint: config.dynamoEndpoint,
        credentials: { accessKeyId: "local", secretAccessKey: "local" },
      }
    : {}),
};
