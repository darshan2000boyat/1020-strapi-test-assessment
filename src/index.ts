import type { Core } from '@strapi/strapi';

const getWeekNumber = (dateStr: string) => {
  const d = new Date(dateStr);
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
};

function formatDateRange(startDate: string, endDate: string) {
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

// Helper function to create individual timesheet-date records
async function createTimesheetDates(
  strapi: Core.Strapi,
  startDate: string,
  endDate: string,
  week: number,
  month: number,
  year: number,
  dateRange: string
) {
  try {
    // Create and publish the timesheet-date
    const timesheetDate = await strapi.documents('api::timesheet-date.timesheet-date').create({
      data: {
        startDate,
        endDate,
        week,
        month,
        year,
        dateRange,
      },
      status: 'published', // ✅ Publishes the document in v5
    });

    strapi.log.info(
      `Created ${timesheetDate.dateRange} timesheet-dates for timesheet (${dateRange})`
    );


    // ✅ Return the numeric id for database-level relation
    return { id: +timesheetDate?.id - 1, documentId: timesheetDate?.documentId };
  } catch (error) {
    strapi.log.error('Error creating timesheet-dates:', error);
    throw error;
  }
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.db.lifecycles.subscribe({
      models: ["api::timesheet.timesheet"],

      async beforeCreate(event: any) {
        const { data } = event.params;


        /**
         * ✅ If relation is already a number OR missing,
         * ✅ it means Strapi is doing internal processing
         */
        if (
          !data.timesheet_date ||
          typeof data.timesheet_date === 'number' || Object.keys(data.timesheet_date).includes("set")
        ) {
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

        // ✅ Get the numeric id (not documentId)
        const relationId = await createTimesheetDates(
          strapi,
          startDate,
          endDate,
          week,
          month,
          year,
          dateRange
        );

        // ✅ Assign the numeric id for database-level relation
        if (relationId) {

          data.timesheet_date = {
            connect: [{ ...relationId, isTemporary: false }], disconnect: []
          };
        }
      },

      async afterCreate(event: any) {
        const { data } = event.params;


      }
    });
  },
};