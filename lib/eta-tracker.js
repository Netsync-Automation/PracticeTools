import { logger } from './safe-logger.js';

/**
 * ETA Tracker - Monitors SA assignment status changes and calculates ETAs
 */
export class ETATracker {
  
  /**
   * Track status change and update ETA calculations
   * @param {Object} assignment - SA assignment object
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} timestamp - Change timestamp
   */
  async trackStatusChange(assignment, oldStatus, newStatus, timestamp = new Date().toISOString()) {
    try {
      const practices = this.parsePractices(assignment.practice);
      const changeTime = new Date(timestamp);
      
      // Track different types of status transitions
      for (const practice of practices) {
        await this.processStatusTransition(assignment, practice, oldStatus, newStatus, changeTime);
      }
      
    } catch (error) {
      logger.error('Error tracking status change', {
        assignmentId: assignment.id,
        oldStatus,
        newStatus,
        error: error.message
      });
    }
  }
  
  /**
   * Process individual status transition for a practice
   */
  async processStatusTransition(assignment, practice, oldStatus, newStatus, changeTime) {
    const transitionType = this.getTransitionType(oldStatus, newStatus);
    if (!transitionType) return;
    
    // Calculate duration based on transition type
    let duration;
    if (transitionType === 'assigned_to_completed') {
      // For SA completion, exclude pending approval time
      duration = this.calculateSACompletionDuration(assignment, changeTime);
    } else {
      // For other transitions, use standard duration calculation
      duration = this.calculateDuration(assignment, oldStatus, changeTime);
    }
    
    if (duration <= 0) return;
    
    const durationHours = duration / (1000 * 60 * 60); // Convert to hours
    
    // Update ETA database
    await this.updateETADatabase(practice, null, transitionType, durationHours);
    
    logger.info('Status transition tracked', {
      assignmentId: assignment.id,
      practice,
      transition: transitionType,
      durationHours: durationHours.toFixed(2)
    });
  }
  
  /**
   * Determine transition type based on status change
   */
  getTransitionType(oldStatus, newStatus) {
    if (oldStatus === 'Pending' && newStatus === 'Unassigned') {
      return 'pending_to_unassigned';
    }
    if (oldStatus === 'Unassigned' && newStatus === 'Assigned') {
      return 'unassigned_to_assigned';
    }
    if (oldStatus === 'Assigned' && newStatus === 'Pending Approval') {
      return 'assigned_to_pending_approval';
    }
    if ((oldStatus === 'Assigned' || oldStatus === 'Pending Approval') && (newStatus === 'Approved' || newStatus === 'Complete')) {
      return 'assigned_to_completed';
    }
    return null;
  }
  
  /**
   * Calculate duration based on assignment timestamps
   */
  calculateDuration(assignment, oldStatus, changeTime) {
    let startTime;
    
    if (oldStatus === 'Pending') {
      startTime = new Date(assignment.createdAt || assignment.created_at || assignment.requestDate);
    } else if (oldStatus === 'Unassigned' && assignment.unassignedAt) {
      startTime = new Date(assignment.unassignedAt);
    } else if (oldStatus === 'Assigned' && assignment.assignedAt) {
      startTime = new Date(assignment.assignedAt);
    } else if (oldStatus === 'Pending Approval' && assignment.pendingApprovalAt) {
      startTime = new Date(assignment.pendingApprovalAt);
    } else {
      // Fallback to creation time or request date
      startTime = new Date(assignment.createdAt || assignment.created_at || assignment.requestDate);
    }
    
    return changeTime.getTime() - startTime.getTime();
  }
  
  /**
   * Calculate SA completion duration excluding pending approval time
   */
  calculateSACompletionDuration(assignment, changeTime) {
    const assignedTime = new Date(assignment.assignedAt);
    let totalDuration = changeTime.getTime() - assignedTime.getTime();
    
    // Subtract pending approval time if it exists
    if (assignment.pendingApprovalAt && assignment.assignedAt) {
      const pendingApprovalTime = new Date(assignment.pendingApprovalAt);
      const approvalDuration = changeTime.getTime() - pendingApprovalTime.getTime();
      totalDuration -= approvalDuration;
    }
    
    return Math.max(totalDuration, 0); // Ensure non-negative
  }
  
  /**
   * Parse practices from assignment practice string
   */
  parsePractices(practiceString) {
    if (!practiceString) return [];
    return practiceString.split(',').map(p => p.trim()).filter(p => p);
  }
  
  /**
   * Update ETA database with new timing data
   */
  async updateETADatabase(practice, saName, transitionType, durationHours) {
    try {
      const response = await fetch('/api/practice-etas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practice,
          saName,
          statusTransition: transitionType,
          durationHours
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update ETA: ${response.statusText}`);
      }
      
    } catch (error) {
      logger.error('Error updating ETA database', {
        practice,
        saName,
        transitionType,
        error: error.message
      });
    }
  }
  
  /**
   * Get current ETA estimates for a practice
   */
  async getETAEstimates(practice, saName = null) {
    try {
      const params = new URLSearchParams({ practice });
      if (saName) params.append('saName', saName);
      
      const response = await fetch(`/api/practice-etas?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      return data.etas;
    } catch (error) {
      logger.error('Error fetching ETA estimates', {
        practice,
        saName,
        error: error.message
      });
      return [];
    }
  }
}

// Export singleton instance
export const etaTracker = new ETATracker();