from des import DesKey  # pip install des


class MyDes:
    _key = None

    def __init__(self, key, encoding_type='gb2312', padding=True):
        self.encoding_type = encoding_type
        self.padding = padding

        self.key = key
        self.des = DesKey(self.key)  # for DES

    @property
    def key(self):
        return self._key

    @key.setter
    def key(self, value):
        if not isinstance(value, bytes):
            value = value.encode(self.encoding_type)
        self._key = value

    def encrypt(self, text):
        if not isinstance(text, bytes):
            text = text.encode(self.encoding_type)
        return self.des.encrypt(text, padding=self.padding).hex()

    def decrypt(self, ciphertext):
        return self.des.decrypt(bytes.fromhex(ciphertext), padding=self.padding).decode(self.encoding_type)


if __name__ == '__main__':
    key = 'TESTKEY2'
    msg = '{"username":"root","password":"passwd","hostname":"10.120.65.140","port":22240,"time":1673928372727}'

    my_des = MyDes(key)
    ct = my_des.encrypt(msg)

    print('--- check_ct: ', ct == '17a0a87c91e4a869a2a52d8b7ea72fba8dbf76f5d56f9d2729038770cca6c717e132548d6c099170f4a085bae36adfecf059e095e0cb37b583cbbc6fc1de163448dc7deba0c24a4de560c695317b71064dd06ef17bddbf1a4e7e10dfba98e777f19387815bbfb21a')

    new_msg = my_des.decrypt(ct)

    print('old_msg --- ', msg)
    print('new_msg --- ', new_msg)




