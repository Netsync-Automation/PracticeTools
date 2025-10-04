import AssumedUserBadge from './AssumedUserBadge';
import { useAssumedUsers } from '../hooks/useAssumedUsers';
import { ToastContainer } from './Toast';
import { useState, useEffect } from 'react';

export default function UserField({ 
  userField, 
  assignmentId, 
  fieldType, 
  assignmentType = 'assignment',
  className = '',
  assignment = null // Pass full assignment object for SA assignments
}) {
  const { handleUserCreated, parseUserField, toasts } = useAssumedUsers();
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const parsedUser = parseUserField(userField);
    
    if (parsedUser && assignmentType === 'sa-assignment' && assignment) {
      // For SA assignments, check database flags instead of text parsing
      let isAssumed = false;
      if (fieldType === 'am') {
        isAssumed = assignment.am_assumed || false;
      } else if (fieldType === 'isr') {
        isAssumed = assignment.isr_assumed || false;
      } else if (fieldType === 'submittedBy') {
        isAssumed = assignment.submitted_by_assumed || false;
      }
      

      setUser({
        ...parsedUser,
        isAssumed
      });
    } else {
      setUser(parsedUser);
    }
  }, [userField, assignmentType, assignment, fieldType, parseUserField]);
  
  if (!user) {
    return <span className={className}>-</span>;
  }

  const onUserCreated = (newUser, assumedUser) => {
    handleUserCreated(newUser, assumedUser, assignmentId, fieldType, assignmentType);
  };

  return (
    <>
      <span className={className}>
        <AssumedUserBadge 
          user={user}
          onUserCreated={onUserCreated}
          type={fieldType}
          fieldType={fieldType}
        />
      </span>
      <ToastContainer toasts={toasts} />
    </>
  );
}