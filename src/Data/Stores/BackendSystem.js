import { observable, action, makeAutoObservable } from 'mobx';
const STATUS = {
	UNINITIALIZED: 'Uninitialized',
	UNREACHABLE: 'Unreachable',
	UNAUTHORIZED: 'Unauthorized',
	PENDING: 'Pending',
	OK: 'OK',
	AUTH_FAIL: 'Authorization fail',
};


class BackendSystem {

	@observable availability = STATUS.UNINITIALIZED;
	@observable authStatus = STATUS.UNAUTHORIZED;
	login = null;
	password = null;
	token = null;
	baseUrl='';
	@observable userId = null;

    constructor(name,authConfig={}) {
        this.name = name;
        this.authConfig = authConfig;
        this.intervals = [];
        makeAutoObservable(this);
    }

    setLoginCredentials(login, password) {
        this.login = login;
        this.password = password;
        this.authenticate();
    }

    @action setAvailability(status) {
        this.availability = status;
    }

    @action setAuthStatus(status) {
        this.authStatus = status;
    }

    @action setUrl(url) {
        this.baseUrl = url;
        this.checkAvailability();
        this.startAvailabilityCheck();
    }

	@action setUserId(id) {
        this.userId = id;
    }

    async fetch(endpoint, options = {}) {
        if (this.availability !== STATUS.OK) {
            throw new Error('Backend is unreachable');
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);
        
        options=this.authConfig.reqOptions(options,this);
		options.signal=controller.signal;
        try {
            const response = await fetch(this.baseUrl + endpoint, options);
            clearTimeout(timeoutId);
            
            if (response.status === 401 || response.status === 403) {
                this.setAuthStatus(STATUS.UNAUTHORIZED);
				console.log(this.name+': Authorization failed');
                throw new Error('Authorization failed');
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
				console.log(this.name+': Timeout');
                this.setAvailability(STATUS.UNREACHABLE);
            }
			console.log(error);
            throw error;
        }
    }

async checkAvailability() {
		//console.log(this.name+': conenction check '+this.baseUrl);
		if (!this.baseUrl) {
			this.setAvailability(STATUS.UNINITIALIZED);
			//console.log(this.name+': no baseUrl');
			return;
		}
		if (this.availability === STATUS.PENDING) return;		//не флудим запросами	
		if (this.availability === STATUS.AUTH_FAIL) return;		//в случае неудачи не повторяем запросы чтобы не тригерить защиту от брутфорса
		if (this.availability !== STATUS.OK) this.setAvailability(STATUS.PENDING);
		let checkUrl=this.baseUrl;
		let options={ method: 'HEAD' };
		if (this.authConfig.checkUrl) {
			checkUrl=this.authConfig.checkUrl(this.baseUrl,options);
		}
        try {
            const response = await fetch(checkUrl, options);
            if (!response.ok && !response.redirected) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.setAvailability(STATUS.OK);
			if (this.authStatus===STATUS.UNAUTHORIZED) this.authenticate();
        } catch (error) {
			console.log(this.name+': connection ERR');
			console.log(error);
            this.setAvailability(STATUS.UNREACHABLE);
        }
    }

async authenticate() {
        if (this.authStatus === STATUS.PENDING || this.availability !== STATUS.OK || !this.login || !this.password) return;
        this.setAuthStatus(STATUS.PENDING);
        try {
			const auth=await this.authConfig.authorize(this);
            if (auth)	{	
				this.setAuthStatus(STATUS.OK);
				this.checkAuthStatus();
			} else {
				this.setAuthStatus(STATUS.AUTH_FAIL);
			}
        } catch (error) {
            console.error(this.name+': Authentication error:', error);
            this.setAuthStatus(STATUS.AUTH_FAIL);
        }
    }

	async checkAuthStatus() {
        try {
			const auth=await this.authConfig.authCheck(this);
            if (auth) {
                this.setAuthStatus(STATUS.OK);
            } else {
                this.setAuthStatus(STATUS.UNAUTHORIZED);
            }
        } catch (error) {
            console.error(this.name+': Auth status check error:', error);
            this.setAuthStatus(STATUS.UNAUTHORIZED);
        }
    }

startAvailabilityCheck() {
        this.clearIntervals();
        const availabilityInterval = setInterval(() => this.checkAvailability(), 10000);
        const authInterval = setInterval(() => this.checkAuthStatus(), 60000);
        this.intervals.push(availabilityInterval, authInterval);
    }

    clearIntervals() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    destroy() {
        this.clearIntervals();
    }
}

export default BackendSystem;