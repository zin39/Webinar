const generateCalendarLinks = (webinar) => {
  const startDate = new Date(webinar.date);
  const endDate = new Date(startDate.getTime() + (webinar.duration || 60) * 60000);

  // Format for Google Calendar (YYYYMMDDTHHmmssZ)
  const formatGoogleDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  // Format for Outlook (ISO string)
  const formatOutlookDate = (date) => {
    return date.toISOString();
  };

  const title = encodeURIComponent(webinar.title || 'Webinar');
  const description = encodeURIComponent(
    `${webinar.description || ''}\n\n${webinar.meetingLink ? 'Join Link: ' + webinar.meetingLink : ''}`
  );
  const location = encodeURIComponent(webinar.meetingLink || 'Online');

  // Google Calendar link
  const googleLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${description}&location=${location}`;

  // Outlook Web link
  const outlookLink = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${formatOutlookDate(startDate)}&enddt=${formatOutlookDate(endDate)}&body=${description}&location=${location}`;

  // ICS file content (for download)
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Webinar//EN
BEGIN:VEVENT
DTSTART:${formatGoogleDate(startDate)}
DTEND:${formatGoogleDate(endDate)}
SUMMARY:${webinar.title || 'Webinar'}
DESCRIPTION:${(webinar.description || '').replace(/\n/g, '\\n')}
LOCATION:${webinar.meetingLink || 'Online'}
END:VEVENT
END:VCALENDAR`;

  return {
    google: googleLink,
    outlook: outlookLink,
    ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`
  };
};

module.exports = { generateCalendarLinks };
