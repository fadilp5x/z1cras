export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // If the path doesn't have an extension and isn't the root
  if (!pathname.includes('.') && pathname !== '/') {
    // Try to fetch the .html version
    const htmlUrl = new URL(url);
    htmlUrl.pathname = pathname + '.html';
    const response = await fetch(htmlUrl.toString());

    // If the .html file exists, return it
    if (response.status === 200) {
      return response;
    }
  }

  // Otherwise, proceed with the default behavior
  return context.next();
}