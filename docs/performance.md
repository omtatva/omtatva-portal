# Performance ratings

* **Page:** `/performance` (linked from the dashboard Quick Actions for Team Lead / Manager / Head / Admin / Super Admin, and from the admin dashboard for Head / Admin / Super Admin). Employees and HR have no rating access.
* **Who rates whom** (decided on the server from `adminAccess` role + `reportingStructure`):
  Team Lead → their direct reports (**needs their manager's approval**) · Manager → everyone under them (published directly) ·
  Head / Admin / Super Admin → anyone (published directly). Nobody rates themselves.
* **Approval:** a Team Lead's rating is a *proposal*. It is approved or sent back (reason required) by that team lead's
  manager, or a Head / Admin / Super Admin. The employee keeps seeing the previously approved rating until then.
* **Employee dashboard:** `PerformanceCard` listens to `performanceIndex/{uid}` (server-written, readable only by that employee).
* **Data:** `performanceRatings/{YYYY-MM}_{employeeUid}` (server-only: current proposal, published rating, history); each action is also written to the activity log.
* Older single ratings stored on the user profile are shown only until a new rating exists. The editor under Users → details was removed.
