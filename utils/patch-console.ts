// Intercept and downgrade any expo-notifications warning
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('expo-notifications: Android Push notifications') ||
       args[0].includes('Android Push notifications'))
    ) {
      console.warn(...args);
      return;
    }
    originalConsoleError(...args);
  };
}
