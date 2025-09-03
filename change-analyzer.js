import { execSync } from 'child_process';
import { readFileSync } from 'fs';

export class ChangeAnalyzer {
  static analyzeChange(filePath) {
    try {
      const diff = execSync(`git diff HEAD "${filePath}"`, { encoding: 'utf8' });
      const content = readFileSync(filePath, 'utf8');
      
      return this.generateSpecificDescription(filePath, diff, content);
    } catch (error) {
      return `Updated ${filePath.split('/').pop()}`;
    }
  }
  
  static generateSpecificDescription(filePath, diff, content) {
    const fileName = filePath.split('/').pop();
    const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
    
    // SidebarLayout menu changes
    if (fileName.includes('SidebarLayout')) {
      if (content.includes('Practice Information') && content.includes('practice-information')) {
        return 'Added Practice Information menu item to sidebar navigation between Dashboard and Practice Issues';
      }
      if (addedLines.some(line => line.includes('menuItems'))) {
        return 'Updated sidebar navigation menu structure';
      }
    }
    
    // Issue type changes
    if (diff.includes('Leadership Question') || diff.includes('Practice Question')) {
      return 'Updated issue types from Bug Report/Feature Request/General Question to Leadership/General/Feature/Practice/Process/Technical/Event Questions';
    }
    
    // WebEx configuration changes
    if (diff.includes('WEBEX_') && diff.includes('SSM')) {
      return 'Updated WebEx configuration to use practice-specific bots with SSM parameter storage';
    }
    
    // Assignment dropdown changes
    if (diff.includes('practice_manager') && diff.includes('practice_principal')) {
      return 'Enhanced assignment dropdowns to prioritize practice-specific leaders (managers and principals) at top of list';
    }
    
    // Breadcrumb fixes
    if (diff.includes('breadcrumb') && diff.includes('Practice Issues')) {
      return 'Fixed breadcrumb navigation to show correct path from Practice Issues or Practice Leadership View';
    }
    
    // WebEx sync improvements
    if (fileName.includes('webex-sync') && diff.includes('allRoomEmails')) {
      return 'Fixed WebEx sync to handle multiple bots without removing users who exist in other WebEx rooms';
    }
    
    // Notification improvements
    if (diff.includes('practice') && diff.includes('WebEx') && diff.includes('bot')) {
      return 'Enhanced WebEx notifications to use practice-specific bots based on issue practice assignment';
    }
    
    return `Enhanced ${fileName.replace('.js', '').replace('-', ' ')} with specific functionality improvements`;
  }
}