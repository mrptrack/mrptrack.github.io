// Bound the complete request, including reading the response body.
export async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Request timed out');
      error.name = 'TimeoutError';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
      })(),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
  }
}
