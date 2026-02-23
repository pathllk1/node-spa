import mongoose from 'mongoose';

const { Schema } = mongoose;

const billSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    bno:        { type: String, required: true },
    bdate:      { type: String, required: true },
    supply:     { type: String },
    addr:       { type: String },
    gstin:      { type: String },
    state:      { type: String },
    pin:        { type: String },
    state_code: { type: String },
    gtot:       { type: Number, required: true, default: 0 },
    ntot:       { type: Number, required: true, default: 0 },
    rof:        { type: Number, default: 0 },
    btype:      { type: String, default: 'SALES' },
    usern:      { type: String },
    firm:       { type: String },
    party_id: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    oth_chg_json:         { type: String },   // JSON string
    order_no:             { type: String },
    vehicle_no:           { type: String },
    dispatch_through:     { type: String },
    narration:            { type: String },
    reverse_charge:       { type: Boolean, default: false },
    cgst:                 { type: Number, default: 0 },
    sgst:                 { type: Number, default: 0 },
    igst:                 { type: Number, default: 0 },
    status:               { type: String, default: 'ACTIVE' },
    cancellation_reason:  { type: String },
    cancelled_at:         { type: Date, default: null },
    cancelled_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    consignee_name:       { type: String },
    consignee_gstin:      { type: String },
    consignee_address:    { type: String },
    consignee_state:      { type: String },
    consignee_pin:        { type: String },
    consignee_state_code: { type: String },
  },
  { timestamps: true }
);

const Bill = mongoose.model('Bill', billSchema);

export default Bill;
