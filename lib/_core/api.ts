import * as Auth from "./auth";

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await Auth.getSessionToken();
  try {
    return await Auth.authRequest<T>(endpoint, { ...options, headers: {
      ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } });
  } catch (error) {
    if (error instanceof Auth.AuthApiError && error.status === 401) await Auth.rejectSessionToken(token);
    throw error;
  }
}
export const getMe = Auth.getUserInfo;
export const logout = Auth.logout;