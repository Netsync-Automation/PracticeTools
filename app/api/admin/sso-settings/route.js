import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';


export const dynamic = 'force-dynamic';
const ENV = process.env.ENVIRONMENT || 'prod';
const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Loading SSO settings for ${ENV} environment`);
    
    // Get current SSO settings from SSM
    const settings = {};
    const parameters = ['SSO_ENABLED', 'DUO_ENTITY_ID', 'DUO_ACS', 'DUO_METADATA_FILE', 'DUO_CERT_FILE'];
    
    for (const param of parameters) {
      try {
        const paramName = ENV === 'prod' ? `/PracticeTools/${param}` : `/PracticeTools/${ENV}/${param}`;
        console.log(`Fetching parameter: ${paramName}`);
        
        const command = new GetParameterCommand({
          Name: paramName,
          WithDecryption: true
        });
        const result = await ssmClient.send(command);
        settings[param] = result.Parameter?.Value || '';
        console.log(`${param}: ${settings[param] ? 'Found' : 'Empty'}`);
      } catch (error) {
        console.log(`${param}: Not found - ${error.message}`);
        settings[param] = '';
      }
    }

    console.log('SSO settings loaded:', Object.keys(settings));
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error getting SSO settings:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ssoEnabled, duoMetadata, duoCertificate } = await request.json();
    console.log(`Saving SSO settings for ${ENV} environment:`);
    console.log(`SSO Enabled: ${ssoEnabled}`);
    console.log(`Metadata provided: ${duoMetadata ? 'Yes' : 'No'}`);
    console.log(`Certificate provided: ${duoCertificate ? 'Yes' : 'No'}`);
    console.log(`Base URL: ${process.env.NEXTAUTH_URL}`);

    // Update SSM parameters
    if (ssoEnabled !== undefined) {
      const enabledParamName = ENV === 'prod' ? '/PracticeTools/SSO_ENABLED' : `/PracticeTools/${ENV}/SSO_ENABLED`;
      console.log(`Saving SSO_ENABLED to: ${enabledParamName} = ${ssoEnabled}`);
      
      const enabledCommand = new PutParameterCommand({
        Name: enabledParamName,
        Value: ssoEnabled.toString(),
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(enabledCommand);
      console.log('SSO_ENABLED saved successfully');
      
      // Auto-generate DUO_ENTITY_ID and DUO_ACS when SSO is enabled
      if (ssoEnabled) {
        const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
        console.log(`Auto-generating URLs with base: ${baseUrl}`);
        
        const entityIdParamName = ENV === 'prod' ? '/PracticeTools/DUO_ENTITY_ID' : `/PracticeTools/${ENV}/DUO_ENTITY_ID`;
        const entityIdValue = `${baseUrl}/api/auth/saml/metadata`;
        console.log(`Saving DUO_ENTITY_ID to: ${entityIdParamName} = ${entityIdValue}`);
        
        const entityIdCommand = new PutParameterCommand({
          Name: entityIdParamName,
          Value: entityIdValue,
          Type: 'String',
          Overwrite: true
        });
        await ssmClient.send(entityIdCommand);
        console.log('DUO_ENTITY_ID saved successfully');
        
        const acsParamName = ENV === 'prod' ? '/PracticeTools/DUO_ACS' : `/PracticeTools/${ENV}/DUO_ACS`;
        const acsValue = `${baseUrl}/api/auth/saml/acs`;
        console.log(`Saving DUO_ACS to: ${acsParamName} = ${acsValue}`);
        
        const acsCommand = new PutParameterCommand({
          Name: acsParamName,
          Value: acsValue,
          Type: 'String',
          Overwrite: true
        });
        await ssmClient.send(acsCommand);
        console.log('DUO_ACS saved successfully');
      }
    }
    if (duoMetadata) {
      const metadataParamName = ENV === 'prod' ? '/PracticeTools/DUO_METADATA_FILE' : `/PracticeTools/${ENV}/DUO_METADATA_FILE`;
      console.log(`Saving DUO_METADATA_FILE to: ${metadataParamName}`);
      console.log(`Metadata length: ${duoMetadata.length}`);
      
      const metadataCommand = new PutParameterCommand({
        Name: metadataParamName,
        Value: duoMetadata.trim(),
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(metadataCommand);
      console.log('DUO_METADATA_FILE saved successfully');
    }

    if (duoCertificate) {
      const certParamName = ENV === 'prod' ? '/PracticeTools/DUO_CERT_FILE' : `/PracticeTools/${ENV}/DUO_CERT_FILE`;
      console.log(`Saving DUO_CERT_FILE to: ${certParamName}`);
      console.log(`Certificate length: ${duoCertificate.length}`);
      
      const certCommand = new PutParameterCommand({
        Name: certParamName,
        Value: duoCertificate.trim(),
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(certCommand);
      console.log('DUO_CERT_FILE saved successfully');
    }

    return NextResponse.json({ success: true, message: 'SSO settings updated successfully' });
  } catch (error) {
    console.error('Error updating SSO settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}