import mongoose from 'mongoose';

const { Schema } = mongoose;

const stockSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    item:    { type: String, required: true },
    pno:     { type: String },
    oem:     { type: String },
    hsn:     { type: String, required: true },
    qty:     { type: Number, required: true, default: 0 },
    uom:     { type: String, required: true, default: 'pcs' },
    rate:    { type: Number, required: true, default: 0 },
    grate:   { type: Number, required: true, default: 0 },
    total:   { type: Number, required: true, default: 0 },
    mrp:     { type: Number },
    batches: { type: String },   // JSON string of batch data
    user:    { type: String },
  },
  { timestamps: true }
);

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;
