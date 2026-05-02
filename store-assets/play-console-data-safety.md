# Google Play — Data Safety Form Answers

Paste these answers when filling out **App content → Data safety** in Play Console.

---

## Section 1: Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS for all server communication) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (in-app Settings + email request) |

---

## Section 2: Data types — declare each as either Collected, Shared, or Neither

### Personal info

| Data | Collected? | Shared? | Required/Optional | Why? |
|---|---|---|---|---|
| Name | Optional / Yes (display name) | No | Optional | App functionality (greeting, profile) |
| Email address | **Yes** | No | Required | Account management |
| User IDs | **Yes** (auto-generated) | No | Required | Account management, App functionality |
| Address | No | — | — | — |
| Phone number | No | — | — | — |
| Race or ethnicity | No | — | — | — |
| Political/religious beliefs | No | — | — | — |
| Sexual orientation | No | — | — | — |
| Other personal info | No | — | — | — |

### Financial info

| Data | Collected? | Shared? | Why? |
|---|---|---|---|
| User payment info | **No** (handled entirely by Google Play / Apple — we never see card numbers) | — | — |
| Purchase history | **Yes** (subscription state only — product ID and purchase token, no card data) | No | App functionality |
| Credit score | No | — | — |
| Other financial info | No | — | — |

### Health and fitness

All **No**.

### Messages

All **No**. (We do not access SMS, email, or other messages.)

### Photos and videos

| Data | Collected? | Shared? | Required/Optional | Why? |
|---|---|---|---|---|
| Photos | **Yes** (only when user attaches photos to vehicles/diagnoses) | No | Optional | App functionality |
| Videos | No | — | — | — |

### Audio files

All **No**.

### Files and docs

All **No**.

### Calendar, Contacts

All **No**.

### App activity

| Data | Collected? | Shared? | Required/Optional | Why? |
|---|---|---|---|---|
| App interactions | **Yes** (which screens viewed, which features used — anonymized) | No | Required | Analytics, App functionality |
| In-app search history | No | — | — | — |
| Installed apps | No | — | — | — |
| Other user-generated content | **Yes** (vehicle info, diagnosis questions/answers, work order notes) | **Yes** (sent to Anthropic Claude API for diagnosis processing — no PII attached) | Required | App functionality (AI diagnosis) |
| Other actions | No | — | — | — |

### Web browsing

All **No**.

### App info and performance

| Data | Collected? | Shared? | Required/Optional | Why? |
|---|---|---|---|---|
| Crash logs | **Yes** | No | Required | Analytics |
| Diagnostics | **Yes** | No | Required | Analytics, App performance |
| Other app performance data | No | — | — | — |

### Device or other identifiers

| Data | Collected? | Shared? | Required/Optional | Why? |
|---|---|---|---|---|
| Device or other IDs | **Yes** (anonymous device ID for crash reporting and subscription state) | No | Required | Analytics, App functionality |

---

## Section 3: Data usage and handling

For **each "Yes" data type above**, when Play Console asks "How is this data used?":

- **Email, User IDs:** Account management, App functionality
- **Name:** App functionality (display in app)
- **Purchase history:** App functionality (entitlement check)
- **Photos:** App functionality (user-attached vehicle records)
- **App interactions:** Analytics, App functionality
- **User-generated content (vehicle info, diagnosis content):** App functionality, sent to a third-party AI provider for diagnosis processing
- **Crash logs, Diagnostics:** Analytics, App performance
- **Device IDs:** Analytics, App functionality

---

## Section 4: Security practices

- **Data is encrypted in transit:** **Yes**
- **Users can request data deletion:** **Yes**
- Follows the [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335) (only relevant if you target children — you do not).
- Has been independently validated against a global security standard: **No** (you can change this later if you obtain SOC 2 / ISO 27001).

