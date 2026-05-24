export type Bindings = {
	DB: D1Database;
	CF_ACCESS_TEAM_DOMAIN?: string;
	CF_ACCESS_AUD?: string;
	ENVIRONMENT: string;
};

export type Variables = {
	accessAuthenticated?: boolean;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
