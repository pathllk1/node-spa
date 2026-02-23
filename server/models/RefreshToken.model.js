import mongoose from 'mongoose';

const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
