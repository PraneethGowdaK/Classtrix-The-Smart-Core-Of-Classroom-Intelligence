// Curriculum Templates for CSE and ISE - 2022 Scheme

export interface SubjectTemplate {
  code: string;
  name: string;
  credits: number;
  total_sessions_planned: number;
}

export interface SemesterTemplate {
  semester: number;
  subjects: SubjectTemplate[];
}

export const CSE_CURRICULUM: SemesterTemplate[] = [
  {
    semester: 1,
    subjects: [
      { code: "22MATS11", name: "Mathematics I", credits: 3, total_sessions_planned: 50 },
      { code: "22PHYS12", name: "Applied Physics", credits: 3, total_sessions_planned: 50 },
      { code: "22CHEM13", name: "Applied Chemistry", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE14", name: "Programming in C", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL15", name: "C Programming Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CAD16", name: "Engineering Drawing", credits: 2, total_sessions_planned: 40 },
      { code: "22ENG17", name: "Communicative English", credits: 1, total_sessions_planned: 25 },
      { code: "22CON18", name: "Indian Constitution", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 2,
    subjects: [
      { code: "22MATS21", name: "Mathematics II", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE22", name: "Data Structures", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL23", name: "Data Structures Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22PHY24", name: "Engineering Physics", credits: 3, total_sessions_planned: 50 },
      { code: "22CHE25", name: "Engineering Chemistry", credits: 3, total_sessions_planned: 50 },
      { code: "22UHV26", name: "Universal Human Values", credits: 1, total_sessions_planned: 25 },
      { code: "22ENV27", name: "Environmental Studies", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 3,
    subjects: [
      { code: "22CSE31", name: "Discrete Mathematical Structures", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE32", name: "Digital Design and Computer Organization", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE33", name: "Operating Systems", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE34", name: "Object Oriented Programming with Java", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL35", name: "Digital Design Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CSEL36", name: "Java Programming Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22IKS37", name: "Indian Knowledge System", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 4,
    subjects: [
      { code: "22CSE41", name: "Analysis and Design of Algorithms", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE42", name: "Database Management Systems", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE43", name: "Microcontrollers", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE44", name: "Software Engineering", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL45", name: "DBMS Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CSEL46", name: "Algorithms Laboratory", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 5,
    subjects: [
      { code: "22CSE51", name: "Computer Networks", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE52", name: "Automata Theory and Compiler Design", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE53", name: "Artificial Intelligence", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL54", name: "Computer Networks Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CSEL55", name: "Artificial Intelligence Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CSE56", name: "Data Mining", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE57", name: "Cyber Security", credits: 3, total_sessions_planned: 50 },
    ]
  },
  {
    semester: 6,
    subjects: [
      { code: "22CSE61", name: "Machine Learning", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE62", name: "Cloud Computing", credits: 3, total_sessions_planned: 50 },
      { code: "22CSEL63", name: "Machine Learning Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22CSEP64", name: "Major Project Phase I", credits: 2, total_sessions_planned: 40 },
      { code: "22CSE65", name: "Big Data Analytics", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE66", name: "Deep Learning", credits: 3, total_sessions_planned: 50 },
    ]
  },
  {
    semester: 7,
    subjects: [
      { code: "22CSE71", name: "Information and Network Security", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE72", name: "Distributed Systems", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE73", name: "Advanced Algorithms", credits: 3, total_sessions_planned: 50 },
      { code: "22CSE74", name: "High Performance Computing", credits: 3, total_sessions_planned: 50 },
    ]
  },
  {
    semester: 8,
    subjects: [
      { code: "22CSEP81", name: "Internship", credits: 4, total_sessions_planned: 80 },
      { code: "22CSEP82", name: "Major Project Phase II", credits: 8, total_sessions_planned: 100 },
    ]
  },
];

export const ISE_CURRICULUM: SemesterTemplate[] = [
  {
    semester: 1,
    subjects: [
      { code: "22MATS11", name: "Mathematics I", credits: 3, total_sessions_planned: 50 },
      { code: "22PHYS12", name: "Applied Physics", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE13", name: "Programming in C", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL14", name: "C Programming Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22ENG15", name: "Communicative English", credits: 1, total_sessions_planned: 25 },
      { code: "22CON16", name: "Indian Constitution", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 2,
    subjects: [
      { code: "22MATS21", name: "Mathematics II", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE22", name: "Data Structures", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL23", name: "Data Structures Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22ENV24", name: "Environmental Studies", credits: 1, total_sessions_planned: 25 },
      { code: "22UHV25", name: "Universal Human Values", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 3,
    subjects: [
      { code: "22ISE31", name: "Discrete Mathematics", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE32", name: "Computer Organization", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE33", name: "Data Structures and Applications", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL34", name: "Data Structures Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22ISEL35", name: "Digital Logic Laboratory", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 4,
    subjects: [
      { code: "22ISE41", name: "Design and Analysis of Algorithms", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE42", name: "Database Management Systems", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE43", name: "Operating Systems", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE44", name: "Software Engineering", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL45", name: "DBMS Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22ISEL46", name: "Operating Systems Laboratory", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 5,
    subjects: [
      { code: "22ISE51", name: "Computer Networks", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE52", name: "Web Technologies", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE53", name: "Data Mining", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL54", name: "Web Technology Laboratory", credits: 1, total_sessions_planned: 25 },
    ]
  },
  {
    semester: 6,
    subjects: [
      { code: "22ISE61", name: "Machine Learning", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE62", name: "Cloud Computing", credits: 3, total_sessions_planned: 50 },
      { code: "22ISEL63", name: "Machine Learning Laboratory", credits: 1, total_sessions_planned: 25 },
      { code: "22ISEP64", name: "Major Project Phase I", credits: 2, total_sessions_planned: 40 },
      { code: "22ISE65", name: "Big Data Analytics", credits: 3, total_sessions_planned: 50 },
    ]
  },
  {
    semester: 7,
    subjects: [
      { code: "22ISE71", name: "Information Security", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE72", name: "Parallel Computing", credits: 3, total_sessions_planned: 50 },
      { code: "22ISE73", name: "Advanced Web Technologies", credits: 3, total_sessions_planned: 50 },
    ]
  },
  {
    semester: 8,
    subjects: [
      { code: "22ISEP81", name: "Internship", credits: 4, total_sessions_planned: 80 },
      { code: "22ISEP82", name: "Major Project Phase II", credits: 8, total_sessions_planned: 100 },
    ]
  },
];

export function getCurriculumTemplate(department: string): SemesterTemplate[] {
  switch (department) {
    case "CS":
      return CSE_CURRICULUM;
    case "IS":
      return ISE_CURRICULUM;
    default:
      return [];
  }
}

export function getSemesterSubjects(department: string, semester: number): SubjectTemplate[] {
  const curriculum = getCurriculumTemplate(department);
  const semesterData = curriculum.find(s => s.semester === semester);
  return semesterData?.subjects || [];
}
