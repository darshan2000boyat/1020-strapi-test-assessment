import { errors } from "@strapi/utils";

const { ValidationError } = errors;

const getWeekNumber = (dateStr) => {
  const d = new Date(dateStr);
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
};

export default {
  async beforeCreate(event) {
    const { data } = event.params;

    if (!data.timesheet_date?.startDate || !data.timesheet_date?.endDate) {
      throw new ValidationError("Start date and end date are required");
    }

    const { startDate, endDate } = data.timesheet_date;

    const week = getWeekNumber(startDate);
    const month = new Date(startDate).getMonth() + 1;
    const year = new Date(startDate).getFullYear();
    const dateRange = `${startDate} - ${endDate}`;

    const createdDate = await strapi
      .documents("api::timesheet-date.timesheet-date")
      .create({
        data: {
          startDate,
          endDate,
          week,
          month,
          year,
          dateRange,
        },
      }
    );

    data.timesheet_date = createdDate.id;
  },
};
