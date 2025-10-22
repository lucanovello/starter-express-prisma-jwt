// Make sure Rollup always uses the portable JS build in workers too
process.env.ROLLUP_SKIP_NODEJS_NATIVE = "1";
