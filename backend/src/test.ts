exports.onExecutePostLogin = async (event, api) => {
    const ManagementClient = require('auth0').ManagementClient;

    const management = new ManagementClient({
        domain: event.secrets['DOMAIN'],
        clientId: event.secrets['CLIENT_ID'],
        clientSecret: event.secrets['CLIENT_SECRET'],
    });

    try {
        const userId = String(event.user.user_id);
        console.log("Looking up user:", userId);

        const user = await management.users.get(userId)

        const githubIdentity = user.data?.identities?.find(
            (i) => i.connection === "github"
        );

        console.log("GitHub identity:", JSON.stringify(githubIdentity));

        if (githubIdentity?.access_token) {
            api.accessToken.setCustomClaim(
                "https://standup-ai.dev/github_token",
                githubIdentity.access_token
            );
            console.log("GitHub token added to JWT");
        } else {
            console.log("No access_token on identity");
        }
    } catch (err) {
        console.log("Management API error:", err.message);
    }
};