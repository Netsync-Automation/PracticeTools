import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'js-yaml';

export class EnvironmentManager {
  static getCurrentEnvironment() {
    return process.env.ENVIRONMENT || 'dev';
  }

  static getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      return 'unknown';
    }
  }

  static getTablePrefix() {
    const environment = this.getCurrentEnvironment();
    return `PracticeTools-${environment}`;
  }

  static getSSMParameterPath() {
    const environment = this.getCurrentEnvironment();
    return environment === 'prod' ? '/PracticeTools/' : `/PracticeTools/${environment}/`;
  }

  static getEnvironmentInfo() {
    return {
      environment: this.getCurrentEnvironment(),
      nodeEnv: process.env.NODE_ENV || 'development',
      currentBranch: this.getCurrentBranch(),
      databasePrefix: this.getTablePrefix(),
      ssmParameterPath: this.getSSMParameterPath()
    };
  }
}