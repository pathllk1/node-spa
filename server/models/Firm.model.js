import mongoose from 'mongoose';

const { Schema } = mongoose;

const firmSchema = new Schema(
  {
    name:                { type: String, required: true, unique: true },
    code:                { type: String },
    description:         { type: String },
    legal_name:          { type: String },
    address:             { type: String },
    city:                { type: String },
    state:               { type: String },
    country:             { type: String },
    pincode:             { type: String },
    phone_number:        { type: String },
    secondary_phone:     { type: String },
    email:               { type: String },
    website:             { type: String },
    business_type:       { type: String },
    industry_type:       { type: String },
    establishment_year:  { type: Number },
    employee_count:      { type: Number },
    registration_number: { type: String },
    registration_date:   { type: String },
    cin_number:          { type: String },
    pan_number:          { type: String },
    gst_number:          { type: String },
    tax_id:              { type: String },
    vat_number:          { type: String },
    bank_account_number: { type: String },
    bank_name:           { type: String },
    bank_branch:         { type: String },
    ifsc_code:           { type: String },
    payment_terms:       { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    license_numbers:   { type: String },
    insurance_details: { type: String },
    currency:          { type: String, default: 'INR' },
    timezone:          { type: String, default: 'Asia/Kolkata' },
    fiscal_year_start: { type: String },
    invoice_prefix:    { type: String },
    quote_prefix:      { type: String },
    po_prefix:         { type: String },
    logo_url:          { type: String },
    invoice_template:  { type: String },
    enable_e_invoice:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Firm = mongoose.model('Firm', firmSchema);

export default Firm;
