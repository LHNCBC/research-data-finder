export interface Settings {
  [paramName: string]: string;
}

export interface Config {
  default: Settings;
  customization: {
    [serviceBaseUrl: string]: Settings;
  };
}
