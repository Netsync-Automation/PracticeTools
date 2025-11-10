Write-Host "Converting Webex Meetings SSM parameters from SecureString to String..." -ForegroundColor Green

function Convert-Environment {
    param(
        [string]$EnvPrefix,
        [string]$EnvName
    )
    
    Write-Host "Processing $EnvName environment..." -ForegroundColor Yellow
    
    # Get current values
    Write-Host "Getting current values..."
    $ClientId = aws ssm get-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_ID" --with-decryption --query 'Parameter.Value' --output text 2>$null
    $ClientSecret = aws ssm get-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_SECRET" --with-decryption --query 'Parameter.Value' --output text 2>$null
    $AccessToken = aws ssm get-parameter --name "$EnvPrefix/WEBEX_MEETINGS_ACCESS_TOKEN" --with-decryption --query 'Parameter.Value' --output text 2>$null
    $RefreshToken = aws ssm get-parameter --name "$EnvPrefix/WEBEX_MEETINGS_REFRESH_TOKEN" --with-decryption --query 'Parameter.Value' --output text 2>$null
    
    # Delete SecureString parameters
    Write-Host "Deleting SecureString parameters..."
    aws ssm delete-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_ID" 2>$null
    aws ssm delete-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_SECRET" 2>$null
    aws ssm delete-parameter --name "$EnvPrefix/WEBEX_MEETINGS_ACCESS_TOKEN" 2>$null
    aws ssm delete-parameter --name "$EnvPrefix/WEBEX_MEETINGS_REFRESH_TOKEN" 2>$null
    
    # Recreate as String parameters
    Write-Host "Recreating as String parameters..."
    
    if ($ClientId -and $ClientId -ne "None") {
        aws ssm put-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_ID" --value "$ClientId" --type "String"
        Write-Host "✓ CLIENT_ID converted" -ForegroundColor Green
    }
    
    if ($ClientSecret -and $ClientSecret -ne "None") {
        aws ssm put-parameter --name "$EnvPrefix/WEBEX_MEETINGS_CLIENT_SECRET" --value "$ClientSecret" --type "String"
        Write-Host "✓ CLIENT_SECRET converted" -ForegroundColor Green
    }
    
    if ($AccessToken -and $AccessToken -ne "None") {
        aws ssm put-parameter --name "$EnvPrefix/WEBEX_MEETINGS_ACCESS_TOKEN" --value "$AccessToken" --type "String"
        Write-Host "✓ ACCESS_TOKEN converted" -ForegroundColor Green
    }
    
    if ($RefreshToken -and $RefreshToken -ne "None") {
        aws ssm put-parameter --name "$EnvPrefix/WEBEX_MEETINGS_REFRESH_TOKEN" --value "$RefreshToken" --type "String"
        Write-Host "✓ REFRESH_TOKEN converted" -ForegroundColor Green
    }
    
    Write-Host "$EnvName environment completed." -ForegroundColor Cyan
    Write-Host ""
}

# Convert Dev environment
Convert-Environment -EnvPrefix "/PracticeTools/dev" -EnvName "Dev"

# Convert Prod environment
Convert-Environment -EnvPrefix "/PracticeTools" -EnvName "Prod"

Write-Host "All Webex Meetings SSM parameters converted to String type!" -ForegroundColor Green