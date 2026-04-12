const Application = require('../models/Application');

/**
 * Get all applications visible to CDC Chairperson (read-only)
 * Returns the same dataset that TNP Head sees:
 * - Applications under review by TNP Head
 * - Applications approved by TNP Head
 * - Applications rejected by TNP Head
 */
const getCDCApplications = async (req, res) => {
    try {
        const applications = await Application.find({
            status: {
                $in: [
                    'UNDER_REVIEW_HEAD',
                    'REJECTED_HEAD',
                    'READY_FOR_COLLECTION',
                    'COLLECTED'
                ]
            }
        })
            .populate('studentId', 'name email rollNumber')
            .populate('departmentId', 'name code')
            .populate('approvedBy', 'name email role')
            .populate('rejectedBy', 'name email role')
            .sort({ updatedAt: -1 });

        res.json(applications);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getCDCApplications };
