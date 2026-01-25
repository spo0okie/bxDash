
export const zabbixAuthScheme={
	authorize: async (be)=>{
		try {
			const response = await fetch(be.baseUrl+'api_jsonrpc.php', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					method: 'user.login',
					params: {
						username:be.login, password:be.password
					},
					id: 1
				})
			});
			
			if (!response.ok) {
				console.error('Zabbix authorization failed:', response.status, response.statusText);
				return false;
			}
			
			const data = await response.json();
			if (data.error) {
				console.error('Zabbix authorization error:', data.error);
				return false; 
			}
			if (data.result) {			
				be.token = data.result;
				return true;
			}
			return false;
		} catch (error) {
			console.error('Zabbix authorization network error:', error);
			return false;
		}
	},

	authCheck: async (be)=>{
		try {
			const response = await be.fetch('api_jsonrpc.php',{
				method: 'POST',
				headers: { 
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					method: 'user.get',
					params: {
						filter: {
							username: be.login
						}
					},
					id: 1
				})
			});
			
			if (!response.ok) {
				console.error('Zabbix auth check failed:', response.status, response.statusText);
				return false;
			}
			
			const data = await response.json();
			if (data.result && data.result[0] && data.result[0].userid) {
				be.setUserId(Number(data.result[0].userid));
				return true;
			}
			return false;
		} catch (error) {
			console.error('Zabbix auth check network error:', error);
			return false;
		}
	},

	checkUrl: (baseUrl,options) => {
		options['headers']={ 'Content-Type': 'application/json' };
		return baseUrl+'api_jsonrpc.php';
	},

	reqOptions: (options,be) => {
		//options.credentials='include';
		if (!options.headers) options.headers={};
		options.method='POST';
		options.headers['Authorization']=`Bearer ${be.token}`;
		options.headers['Content-Type']='application/json';
		return options;
	}
}