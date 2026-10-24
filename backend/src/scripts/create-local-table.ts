// Creates the single DynamoDB table + TypeIndex GSI in DynamoDB Local for dev.
// Idempotent: skips creation if the table already exists.
// Run: npm run db:setup   (see package.json)

import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { config, dynamoClientOptions } from "../config.js";

const client = new DynamoDBClient(dynamoClientOptions);

async function exists(name: string): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (err) {
    if (err instanceof ResourceNotFoundException) return false;
    throw err;
  }
}

async function main() {
  if (!config.dynamoEndpoint) {
    console.error(
      "Refusing to create a table against real AWS. Set DYNAMODB_ENDPOINT for local dev " +
        "(deployed tables are managed by SAM/template.yaml).",
    );
    process.exit(1);
  }

  if (await exists(config.tableName)) {
    console.log(`Table "${config.tableName}" already exists — nothing to do.`);
    return;
  }

  await client.send(
    new CreateTableCommand({
      TableName: config.tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
        { AttributeName: "type", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "TypeIndex",
          KeySchema: [
            { AttributeName: "type", KeyType: "HASH" },
            { AttributeName: "PK", KeyType: "RANGE" },
          ],
          Projection: { ProjectionType: "ALL" },
        },
      ],
    }),
  );
  console.log(`Created table "${config.tableName}" with TypeIndex in DynamoDB Local.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
