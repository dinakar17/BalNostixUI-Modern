type Environment = "development" | "uat" | "production";

const ENV_NAME = (process.env.EXPO_PUBLIC_APP_VARIANT as Environment) || "uat";

const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || "0.0.84";
const APP_RELEASE_DATE = process.env.EXPO_PUBLIC_APP_RELEASE_DATE || "1";

const ENV_CONFIG = {
  development: {
    FMS_URL: "https://fmsdev.bajajauto.co.in",
    SAP_URL: "http://agni.bajajauto.co.in:7772/RESTAdapter/QAS/vin_comp_serial",
    SAP_API_KEY:
      "ZNpoMzBGhivpXvmgVgwaEoGeNzatFxHDvmrxbkzYxZJQRradVJSXxYXQLuPMqnzI",
    ENABLE_LOGS: true,
    FLAVOR_NAME: "dev",
  },
  uat: {
    FMS_URL: "https://fmsuat.bajajauto.com",
    SAP_URL: "http://agni.bajajauto.co.in:7772/RESTAdapter/QAS/vin_comp_serial",
    SAP_API_KEY:
      "ZNpoMzBGhivpXvmgVgwaEoGeNzatFxHDvmrxbkzYxZJQRradVJSXxYXQLuPMqnzI",
    ENABLE_LOGS: true,
    FLAVOR_NAME: "uat",
  },
  production: {
    FMS_URL: "https://fms.bajajauto.com",
    SAP_URL: "http://agni.bajajauto.co.in:9099/RESTAdapter/PRD/vin_comp_serial",
    SAP_API_KEY:
      "pAYUOdwrsWSfHEdYRNJzHuMJrYWbeOTBzBSxjkaBwhYZCincELGsDFplheICyfeF",
    ENABLE_LOGS: false,
    FLAVOR_NAME: "prod",
  },
} as const;

export const ENV = {
  ...ENV_CONFIG[ENV_NAME],
  ENV_NAME,
  IS_DEV: ENV_NAME === "development",
  IS_UAT: ENV_NAME === "uat",
  IS_PROD: ENV_NAME === "production",
  APP_VERSION,
  APP_RELEASE_DATE,
};
