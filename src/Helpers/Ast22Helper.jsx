
export const ast22AuthScheme={
	authorize: async (be)=>{
		try {
			const response = await fetch(be.baseUrl+'api/v1/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username:be.login, password:be.password })
			});

			if (!response.ok) {
				console.error('Ast22 authorization failed:', response.status, response.statusText);
				return false;
			}

			const data = await response.json();
			if (data?.success && data?.data?.accessToken) {
				be.token = data.data.accessToken;
				if (data.data.user?.id) be.setUserId(Number(data.data.user.id));
				return true;
			}
			return false;
		} catch (error) {
			console.error('Ast22 authorization error:', error);
			return false;
		}
	},

	authCheck: async (be)=>{
		if (!be.token) return false;
		try {
			const response = await be.fetch('api/v1/auth/me');
			if (!response.ok) return false;
			const data = await response.json();
			if (data?.success && data?.data?.user?.id) {
				be.setUserId(Number(data.data.user.id));
				return true;
			}
			return false;
		} catch (error) {
			console.error('Ast22 auth check error:', error);
			return false;
		}
	},

	reqOptions: (options,be) => {
		if (!options.headers) options.headers={};
		if (be.token) options.headers['Authorization']=`Bearer ${be.token}`;
		return options;
	},

	checkUrl: (baseUrl) => baseUrl+'api/v1/health',
}
