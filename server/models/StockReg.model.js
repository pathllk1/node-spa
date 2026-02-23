import mongoose from 'mongoose';

const { Schema } = mongoose;

const stockRegSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    type:           { type: String, required: true },
    bno:            { type: String },
    bdate:          { type: String },
    supply:         { type: String },
    item:           { type: String, required: true },
    item_narration: { type: String },
    batch:          { type: String },
    hsn:            { type: String },
    qty:            { type: Number, required: true },
    uom:            { type: String },
    rate:           { type: Number, default: 0 },
    grate:          { type: Number, default: 0 },
    disc:           { type: Number, default: 0 },
    total:          { type: Number, default: 0 },
    stock_id: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      default: null,
    },
    bill_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    user:  { type: String },
    firm:  { type: String },
    qtyh: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const StockReg = mongoose.model('StockReg', stockRegSchema);

export default StockReg;
