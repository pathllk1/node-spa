import mongoose from 'mongoose';

const { Schema } = mongoose;

// Batch sub-schema for stock batches
const batchSchema = new Schema({
  batch:   { type: String },
  qty:     { type: Number, required: true },
  uom:      { type: String, required: true, default: 'PCS' },
  rate:    { type: Number, required: true },
  grate:   { type: Number, required: true, default: 18 },
  expiry:  { type: Date },
  mrp:     { type: Number },
}, { _id: true }); // Allow _id generation for batch documents

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
    batches: [batchSchema],   // Array of batch objects
    user:    { type: String },
  },
  { timestamps: true }
);

const Stock = mongoose.model('Stock', stockSchema);

export default Stock;
