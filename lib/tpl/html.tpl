<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="author" content="">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta http-equiv="pragma" content="no-cache">
    <meta http-equiv="cache-control" content="no-cache">
    <meta http-equiv="expires" content="0">
    <meta name="description" content="">
    <title>${#title#}</title>
</head>
<body>
    <!#-- if: ${#useEsl=true#} --#>
    <script src="http://s1.bdstatic.com/r/www/cache/ecom/esl/2-1-0/esl.js"></script>
    <!#-- /if --#>
    <!#-- if: ${#useEsl=true#} --#>
    <script>
        require(['main'], function (main) {
            // init entry
        });
    </script>
    <!#-- /if --#>
</body>
</html>
