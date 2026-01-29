
export const bxAuthScheme={
	authorize: async (be)=>{
		try {
			const response = await fetch(be.baseUrl+'user/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user:be.login, password:be.password })
			});
			
			if (!response.ok) {
				console.error('Bx authorization failed:', response.status, response.statusText);
				return false;
			}
			
			const data = await response.json();
			if (!data?.auth) return false;
			if (data.hash) {
				be.token = data.hash;
				return true;
			}
			return false;
		} catch (error) {
			console.error('Bx authorization error:', error);
			return false;
		}
	},

	authCheck: async (be)=>{
		try {
			const response = await be.fetch('user/get');
			
			if (!response.ok) {
				console.error('Bx auth check failed:', response.status, response.statusText);
				return false;
			}
			
			const data = await response.json();
			if (data?.id) {
				be.setUserId(Number(data.id));
				return true;
			}
			return false;
		} catch (error) {
			console.error('Bx auth check error:', error);
			return false;
		}
	},

	reqOptions: (options,be) => {
		//options.credentials='include';
		if (!options.headers) options.headers={};
		options.headers['Authorization']='Basic ' + btoa(`${be.login}:${be.password}`);
		return options;
	},
	checkUrl: (baseUrl) => baseUrl+'user/get',
}