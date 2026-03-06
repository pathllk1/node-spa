import mongoose from 'mongoose';

const { Schema } = mongoose;

const loginAuditSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'locked', 'suspicious'],
      default: 'attempt',
    },
    ip_address: {
      type: String,
      required: true,
    },
    user_agent: {
      type: String,
      default: null,
    },
    device_id: {
      type: String,
      default: null,
      index: true,
    },
    device_fingerprint: {
      type: String,
      default: null,
    },
    failure_reason: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
    },
    is_known_device: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient querying by user and timestamp
loginAuditSchema.index({ user_id: 1, createdAt: -1 });

const LoginAudit = mongoose.model('LoginAudit', loginAuditSchema);

export default LoginAudit;
