import mongoose from 'mongoose';

const { Schema } = mongoose;

const partySchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    firm:       { type: String, required: true },
    gstin:      { type: String, default: 'UNREGISTERED' },
    contact:    { type: String },
    state:      { type: String },
    state_code: { type: String },
    addr:       { type: String },
    pin:        { type: String },
    pan:        { type: String },
    usern:      { type: String },
    supply:     { type: String },
  },
  { timestamps: true }
);

const Party = mongoose.model('Party', partySchema);

export default Party;
