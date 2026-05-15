const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function requestWithRetry(requestFn, retries = 2, delayMs = 1200) {
  try {
    return await requestFn();
  } catch (error) {
    const status = error.response?.status;
    const shouldRetry = retries > 0 && status !== 401 && status !== 403;

    if (!shouldRetry) {
      throw error;
    }

    await wait(delayMs);
    return requestWithRetry(requestFn, retries - 1, delayMs * 1.6);
  }
}

export default requestWithRetry;
