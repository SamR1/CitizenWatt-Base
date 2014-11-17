
            <div class="clearfix pre-footer"><div/>
            <footer>
                <p>
                    % if valid_session():
                    <a href="{{ get_url('logout') }}">
                        Déconnexion
                    </a>
                    % end
                </p>
                <p>
                    Adresse alternative&nbsp;: <a href="{{ ip_address }}">{{ ip_address }}</a> | Licence GNU GPL | <a href="http://www.citizenwatt.paris/">CitizenWatt</a>
                </p>
            </footer>
        </div>

        <script type="text/javascript">
            // Constants set on the server side
            var API_URL = '{{ API_URL }}api';
        </script>
        % if defined('scripts'):
        % for script in scripts:
        <script src="{{ get_url('static', filename='js/' + script + '.js') }}"></script>
        % end
        % end
    </body>
</html>
