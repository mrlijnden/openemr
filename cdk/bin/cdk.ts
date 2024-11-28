#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkStack } from "../lib/cdk-stack";

const app = new cdk.App();
new CdkStack(app, "CdkStack", {
    env: { account: "522814719900", region: "eu-central-1" }, // Replace with your AWS Account ID and Region
});
