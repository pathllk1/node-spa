import mongoose from 'mongoose';

const { Schema } = mongoose;

const ledgerSchema = new Schema(
  {
    firm_id: {
      type: Schema.Types.ObjectId,
      ref: 'Firm',
      required: true,
    },
    voucher_id:       { type: Number },       // logical voucher group id (not a ref)
    voucher_type:     { type: String },
    voucher_no:       { type: String },
    account_head:     { type: String, required: true },
    account_type:     { type: String },
    debit_amount:     { type: Number, default: 0 },
    credit_amount:    { type: Number, default: 0 },
    narration:        { type: String },
    bill_id: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    party_id: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      default: null,
    },
    tax_type:         { type: String },
    tax_rate:         { type: Number },
    transaction_date: { type: String },
    created_by:       { type: String },       // stored as username string in original schema
  },
  { timestamps: true }
);

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;
