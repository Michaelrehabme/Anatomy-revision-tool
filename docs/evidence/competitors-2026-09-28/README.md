# Competitor pricing evidence — 28 Sep 2026

Captured headlessly (Playwright + Chromium, 1440x900 viewport, locale en-GB, timezone Europe/London) for the LocusMSK claims register. Each PNG has a black banner across the top that gives the capture time, the time zone and the exact URL. Prices below were read from the page text at capture time, not from the image.

| File | URL | Captured (Europe/London) | HTTP / block | Headline prices visible |
|---|---|---|---|---|
| teachmeanatomy-pricing.png | https://teachmeanatomy.info/sign-up/ | 28 Sep 2026 16:17 | 200 | Monthly £25/month; Quarterly £15/month (£45 billed every 3 months); Yearly £8/month (£96 billed every 12 months); Lifetime £195 one payment. 7-day money-back guarantee on all plans. |
| teachmeanatomy-virtual-academy.png | https://teachmeanatomy.info/teachmeanatomy-virtual-academy/ | 28 Sep 2026 16:18 | 200 | Not shown: institutional pricing is in a downloadable brochure or by demo. The page lists a "Faculty dashboard with engagement metrics" (logins, articles read, questions answered, average quiz accuracy). |
| kenhub-pricing.png | https://www.kenhub.com/en/pricing | 28 Sep 2026 16:17 | 200 | Monthly £25/mo; 3 Months £19/mo (£57 every 3 months, struck-through £25, "Save £18"); Lifetime £190 one-time (struck-through £300, "Save £110"). Prices shown in GBP. |
| completeanatomy-pricing.png | https://store.3d4medical.com/ | 28 Sep 2026 16:19 | 200 | Student £34.99 first year, annual subscription (struck-through £69.99; "Pricing returns to full price after discounted year"); Professional £94.99 annual; Institutional is contact sales. 3-day free trial. |
| visiblebody-home.png | https://www.visiblebody.com/ | 28 Sep 2026 16:17 | 200 | Not shown (home page). |
| visiblebody-student.png | https://www.visiblebody.com/student-learning | 28 Sep 2026 16:19 | 200 | Not shown. The page links to VB Suite for self-study and to Courseware for course assignments. |
| visiblebody-pricing.png (viewport) and visiblebody-pricing-fullpage.png | https://www.visiblebody.com/anatomy-and-physiology-apps/vb-suite | 28 Sep 2026 16:20 | 200 | Taken after clicking "Buy now", which opens a "Compare plans" modal: Student Subscription $34.99/year; Classroom/Professional $199/year; Institutional Site is "Learn more". Prices are in USD even under en-GB. The cookie banner could not be dismissed and covers the bottom of the viewport shot, but the prices are clear of it. |
| remnote-pricing.png | https://www.remnote.com/pricing | 28 Sep 2026 16:18 | 200 | Free US$0; Pro US$8/month (US$96 billed yearly); Pro with AI US$18/month (US$216 billed yearly). This is the default Yearly toggle; the Monthly and Lifetime tabs were not captured. Prices are in USD even under en-GB. The FAQ has "Do you offer student discounts?", but the answer is collapsed. |
| quizlet-upgrade.png | https://quizlet.com/upgrade | 28 Sep 2026 16:18 | **403: blocked** | Not shown. A bot challenge ("Press & Hold to confirm you are a human", reference ID d4b1d128-bb4f-11f1-9a84-5cb3df729035) served in place of the page. |

## Blocked or incomplete

- **Quizlet** blocked automated access (HTTP 403, a press-and-hold bot check). It needs a manual capture in a normal browser.
- **Complete Anatomy**: the store scrolls inside a container, so the "full-page" capture is only one viewport tall. The Student, Professional and Institutional cards and their prices are all within it.
- **Visible Body** shows prices only in a JS modal, so the page had to be clicked open before capture.
