const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        enum: ['cash', 'transfer', 'e-wallet'],
        required: true
    },
    reference: {
        type: String
    },
    status: {
        type: String,
        enum: ['success', 'pending', 'failed'],
        default: 'success'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Payment', PaymentSchema);
