## 📋 Specifications

### L1: High-Level Requirements

- **R1.1 Resource Efficiency:** The application must reduce CPU and Network usage when not in the foreground.
- **R1.2 Freshness:** The application must immediately check for updates when the user returns to the tab.

### L2: Functional Requirements

- **R2.1 Visibility Detection:** Must use the Page Visibility API (`visibilitychange`) rather than `focus/blur` (which are unreliable for backgrounding).
- **R2.2 SSR Guard:** Must not crash or throw errors in server-side environments.

### L3: Implementation Details

- **R3.1 RxJS Subjects:** Must use `Subject` to multicast events to multiple subscribers.
- **R3.2 Cleanup:** Must remove event listeners in `ngOnDestroy` (though strictly speaking, Root services are rarely destroyed, it is best practice).
