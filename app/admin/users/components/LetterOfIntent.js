
export default function LetterOfIntent({
  employeeName,
  designation,
  joiningDate,
  currentDate,
}) {
  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        margin: "auto",
        padding: "60px",
        background: "#fff",
        color: "#000",
        fontFamily: "Times New Roman",
        lineHeight: "1.8",
        fontSize: "16px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ margin: 0 }}>OMTATVA DIGITALS</h1>
        <h2 style={{ marginTop: "10px" }}>
          LETTER OF INTENT
        </h2>
      </div>

      <p>
        <strong>Date:</strong> {currentDate}
      </p>

      <p>
        <strong>To</strong>
        <br />
        {employeeName}
      </p>

      <p>Dear <strong>{employeeName}</strong>,</p>

      <p>
        Greetings from <strong>OMTATVA DIGITALS</strong>.
      </p>

      <p>
        We are pleased to inform you that you have been
        selected for the position of{" "}
        <strong>{designation}</strong> with
        <strong> OMTATVA DIGITALS</strong>.
      </p>

      <p>
        Your proposed joining date shall be{" "}
        <strong>{joiningDate}</strong>.
      </p>

      <p>
        This Letter of Intent outlines the proposed
        assessment, training and onboarding process prior
        to your confirmation as a permanent employee of
        the Company.
      </p>

      <h3>1. Assessment Period</h3>

      <p>
        You shall initially undergo a 30-day Assessment
        Period during which the Company shall evaluate
        your:
      </p>

      <ul>
        <li>Technical Skills</li>
        <li>Professional Conduct</li>
        <li>Performance & Productivity</li>
        <li>Learning Ability</li>
        <li>Communication Skills</li>
        <li>Attendance & Discipline</li>
        <li>Overall Suitability</li>
      </ul>

      <h3>2. Assessment Completion</h3>

      <p>
        Upon successful completion of the assessment and
        evaluation process, you shall receive:
      </p>

      <ul>
        <li>Assessment Completion Certificate</li>
        <li>
          Assessment reimbursement (if applicable)
          according to Company Policy.
        </li>
      </ul>

      <h3>3. Training Period</h3>

      <p>
        After clearing the assessment, you shall be
        enrolled into the Company's professional training
        program.
      </p>

      <p>
        During this period, you shall work as a
        Contractual Employee and shall receive salary and
        benefits according to Company policy.
      </p>

      <h3>4. Full-Time Employment</h3>

      <p>
        Upon successful completion of the training period
        and satisfactory performance, you shall be
        considered for Full-Time Employment with
        OMTATVA DIGITALS.
      </p>

      <p>
        A formal Appointment Letter shall then be issued.
      </p>

      <h3>5. Training Investment</h3>

      <p>
        The Company invests significant time, resources,
        AI tools, software licenses, infrastructure,
        mentorship and business knowledge during your
        assessment and training.
      </p>

      <p>
        Therefore, if you voluntarily resign or abandon
        your engagement during the training period, you
        may be liable to reimburse reasonable training
        expenses incurred by the Company in accordance
        with Company Policy.
      </p>

      <h3>6. Confidentiality</h3>

      <p>
        You shall maintain complete confidentiality
        regarding all Company information including but
        not limited to:
      </p>

      <ul>
        <li>Client Information</li>
        <li>AI Workflows</li>
        <li>Source Code</li>
        <li>Business Strategies</li>
        <li>Creative Assets</li>
        <li>Internal Documents</li>
        <li>Marketing Information</li>
      </ul>

      <h3>7. Nature of this Letter</h3>

      <p>
        This Letter of Intent is not an Appointment
        Letter and shall remain subject to:
      </p>

      <ul>
        <li>Assessment Completion</li>
        <li>Training Completion</li>
        <li>Background Verification</li>
        <li>Required Documentation</li>
        <li>Company Policies</li>
      </ul>

      <h3>Acceptance</h3>

      <p>
        Kindly confirm your acceptance by replying to the
        email with:
      </p>

      <p style={{ textAlign: "center" }}>
        <strong>
          "Accepted and Confirmed."
        </strong>
      </p>

      <p>
        We look forward to welcoming you to
        OMTATVA DIGITALS and wish you success in your
        professional journey.
      </p>

      <br />

      <p>
        Warm Regards,
      </p>

      <p>
        <strong>HR Department</strong>
        <br />
        OMTATVA DIGITALS
      </p>
    </div>
  );
}