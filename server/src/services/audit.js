const { AuditLog, Notification } = require('../models');

// taskType values must match the Audit Logs filter list exactly
const TASK_TYPES = [
  'Project Creation', 'Project Updated', 'Project Deleted', 'Task Assigned', 'Task Completed',
  'Design Brief Uploaded', 'Design Brief Saved', 'Record Deleted', 'User Login', 'Password Reset',
  'User Created', 'User Updated', 'User Deleted', 'Review Comment Added', 'Review Comment Deleted', 'PDF Exported',
];

async function audit(userId, taskType, description, projectId = null) {
  try {
    await AuditLog.create({ userId: userId || null, taskType, description, projectId });
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}

async function notify(userId, type, message, metadata = {}) {
  if (!userId) return;
  try {
    await Notification.create({ userId, type, message, metadata });
  } catch (e) {
    console.error('notification failed', e.message);
  }
}

module.exports = { audit, notify, TASK_TYPES };
