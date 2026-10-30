/** Sample RAMS "My Class Schedules" tables, as copied from the page (cells split by tabs and lines). */

function row(code: string, section: string, units: string, ...lines: string[]): string {
  return [`${code}\t${section}\t${units}\t`, ...lines].join('\n')
}

/** 2025-2026, Term 3: 6 subjects, 11 meetings. */
export const SAMPLE_TERM3 = [
  row('ALPHA1', 'AB101', '2.0', 'Monday', 'Monday', '1:30PM - 3:30PM', '12:50PM - 1:30PM', '1001', 'ASYNC', 'Doe, Jordan Ray'),
  row('BRAVO1', 'XYZ01-T', '3.0', 'Tuesday', '1:30PM - 3:30PM', '508-A', 'Smith, Pat Jr. Lee'),
  row('CHARLIE1', 'AB101', '3.0', 'Tuesday', 'Friday', '7:30AM - 9:30AM', '7:30AM - 9:30AM', '208', '208', 'Cruz, Sam Dee Park'),
  row('DELTA1', 'AB101', '3.0', 'Tuesday', 'Friday', '3:30PM - 5:30PM', '3:30PM - 5:30PM', '205', '205', 'Tan, Robin Kay Lim'),
  row('ECHO1', 'XY01', '3.0', 'Monday', 'Thursday', '3:30PM - 5:30PM', '3:30PM - 5:30PM', '314', '314', 'Lopez, Casey-Lou Bay'),
  row('FOXTROT1', 'AB101/AB102', '3.0', 'Monday', 'Thursday', '9:30AM - 11:30AM', '9:30AM - 11:30AM', '502', '502', 'Rivera, Morgan Vale'),
].join('\n')

/** 2026-2027, Term 1: 6 subjects, 11 meetings. */
export const SAMPLE_TERM1 = [
  row('GOLF1', 'CD243', '3.0', 'Tuesday', 'Friday', '9:30AM - 11:30AM', '9:30AM - 11:30AM', '206', '206', 'Garcia, Drew Eli Kent'),
  row('HOTEL1', 'AB101', '3.0', 'Monday', 'Thursday', '7:30AM - 9:30AM', '7:30AM - 9:30AM', 'Library', 'Library', 'Santos, Jamie Lane Ray'),
  row('INDIA1', 'AB101/AB102', '3.0', 'Saturday', '7:30AM - 11:30AM', '502', 'Reed, Taylor Jay Moss'),
  row('JULIET1', 'AB101', '3.0', 'Tuesday', 'Friday', '1:30PM - 3:30PM', '1:30PM - 3:30PM', '318', '318', 'Park, Avery Wed Lee'),
  row('KILO1', 'AB101/AB102/EF251', '3.0', 'Monday', 'Thursday', '9:30AM - 11:30AM', '9:30AM - 11:30AM', '502', '502', 'Rivera, Morgan Vale'),
  row('LIMA1', 'XY01', '3.0', 'Tuesday', 'Friday', '3:30PM - 5:30PM', '3:30PM - 5:30PM', '314', '314', 'Lopez, Casey-Lou Bay'),
].join('\n')

/** 2026-2027, Term 2: 5 subjects, 9 meetings. */
export const SAMPLE_TERM2 = [
  row('MIKE1', 'AB101', '3.0', 'Tuesday', 'Friday', '9:30AM - 11:30AM', '9:30AM - 11:30AM', '318', '318', 'Lopez, Casey-Lou Bay'),
  row('NOVEMBER1', 'AB101', '3.0', 'Tuesday', 'Friday', '7:30AM - 9:30AM', '7:30AM - 9:30AM', '208', '208', 'Smith, Pat Jr. Lee'),
  row('OSCAR1', 'AB101/AB102', '3.0', 'Saturday', '7:30AM - 11:30AM', '502', 'Reed, Taylor Jay Moss'),
  row('PAPA1', 'XY01', '3.0', 'Tuesday', 'Friday', '3:30PM - 5:30PM', '3:30PM - 5:30PM', '314', '314', 'Lopez, Casey-Lou Bay'),
  row('QUEBEC1', 'AB101', '3.0', 'Tuesday', 'Friday', '1:30PM - 3:30PM', '1:30PM - 3:30PM', '203', '203', 'Ng, Ellis Zoe Ora'),
].join('\n')

const SIDEBAR = [
  'FINANCE TRANSACTIONS', 'Online Payment', 'Promissory Note', 'Payment Records', 'SOA',
  'REGISTRATION/ENROLLMENT', 'Masterlist of Subject Offering', 'Registration Confirmation', 'Clearance Issues',
  'RAM Enrollment Lane', 'Enrollment', 'Load Revision', 'STUDENT RECORDS', 'Current Registration',
  'Student Information', 'My Class Schedules/Assessments', 'My Grades', 'My Vaccination',
]

/** A table wrapped in the rest of the page, as select-all and copy gives it. `term` reads like `2026 -2027, Term 2`. */
export function wholePage(table: string, term: string): string {
  return [
    ...SIDEBAR,
    'Class Schedule',
    `Academic Year & Term: ${term}`,
    'Student No: 2000-000000',
    'Student Name: DOE, JANE SAMPLE',
    'Course: Bachelor of Science in Sample Studies',
    'Scholarship: Sample Scholarship',
    'Subject Code', 'Section', 'Units', 'Day', 'Time', 'Room', 'Instructor',
    table,
    'Total Units: 15.0',
    'You are officially enrolled as of Oct 22 2026 1:34 PM',
    'Course Flowchart',
    'Assessment',
    'Copyright © 2020 Asia Pacific College. All rights reserved.',
  ].join('\n')
}
