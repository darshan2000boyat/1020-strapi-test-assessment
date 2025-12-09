"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getWeekNumber = (dateStr) => {
    const d = new Date(dateStr);
    const firstDay = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
    return Math.ceil((days + firstDay.getDay() + 1) / 7);
};
function formatDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
    });
    const endFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    return `${startFormatter.format(start)} - ${endFormatter.format(end)}`;
}
async function createTimesheetDates(strapi, startDate, endDate, week, month, year, dateRange) {
    try {
        const timesheetDate = await strapi.documents('api::timesheet-date.timesheet-date').create({
            data: {
                startDate,
                endDate,
                week,
                month,
                year,
                dateRange,
            },
            status: 'published',
        });
        strapi.log.info(`Created ${timesheetDate.dateRange} timesheet-dates for timesheet (${dateRange})`);
        return { id: +(timesheetDate === null || timesheetDate === void 0 ? void 0 : timesheetDate.id) - 1, documentId: timesheetDate === null || timesheetDate === void 0 ? void 0 : timesheetDate.documentId };
    }
    catch (error) {
        strapi.log.error('Error creating timesheet-dates:', error);
        throw error;
    }
}
exports.default = {
    register( /* { strapi }: { strapi: Core.Strapi } */) { },
    bootstrap({ strapi }) {
        strapi.db.lifecycles.subscribe({
            models: ["api::timesheet.timesheet"],
            async beforeCreate(event) {
                const { data } = event.params;
                /**
                 * ✅ If relation is already a number OR missing,
                 * ✅ it means Strapi is doing internal processing
                 */
                if (!data.timesheet_date ||
                    typeof data.timesheet_date === 'number' || Object.keys(data.timesheet_date).includes("set")) {
                    return;
                }
                const { startDate, endDate } = data.timesheet_date;
                if (!startDate || !endDate) {
                    throw new Error('startDate and endDate are required for timesheet');
                }
                if (new Date(endDate) < new Date(startDate)) {
                    throw new Error('endDate must be after or equal to startDate');
                }
                const week = getWeekNumber(startDate);
                const month = new Date(startDate).getMonth() + 1;
                const year = new Date(startDate).getFullYear();
                const dateRange = formatDateRange(startDate, endDate);
                const relationId = await createTimesheetDates(strapi, startDate, endDate, week, month, year, dateRange);
                if (relationId) {
                    data.timesheet_date = {
                        connect: [{ ...relationId, isTemporary: false }], disconnect: []
                    };
                }
            },
            async beforeDelete(event) {
                var _a;
                const where = (_a = event.params) === null || _a === void 0 ? void 0 : _a.where;
                if (!(where === null || where === void 0 ? void 0 : where.id))
                    return;
                const timesheetId = where.id;
                const timesheet = await strapi
                    .documents("api::timesheet.timesheet")
                    .findMany({
                    filters: { id: timesheetId },
                    populate: ["timesheet_date"],
                    limit: 1,
                });
                const record = timesheet[0];
                if (!(record === null || record === void 0 ? void 0 : record.timesheet_date))
                    return;
                const timesheetDateDocumentId = record.timesheet_date.documentId;
                if (!timesheetDateDocumentId)
                    return;
                try {
                    await strapi
                        .documents("api::timesheet-date.timesheet-date")
                        .delete({
                        documentId: timesheetDateDocumentId,
                    });
                    strapi.log.info(`Deleted timesheet-date (${timesheetDateDocumentId}) for timesheet id ${timesheetId}`);
                }
                catch (error) {
                    strapi.log.error("Failed to delete timesheet-date", error);
                    throw error;
                }
            }
        });
    },
};
