export const formatDate = (
  date: Date | string,
  dateFormat: string = 'yyyy-MM-dd',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (dateFormat === 'yyyy-MM-dd') {
    return dateObj.toISOString().split('T')[0];
  }

  return dateObj.toLocaleDateString();
};

export const isDateInFuture = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj > new Date();
};

export const isDateInPast = (date: Date | string): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj < new Date();
};

export const getDaysBetweenDates = (
  startDate: Date | string,
  endDate: Date | string,
): number => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};
